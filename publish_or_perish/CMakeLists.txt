cmake_minimum_required(VERSION 3.8)
project(publish_or_perish)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(std_srvs REQUIRED)

add_executable(farm_node src/farm_node.cpp src/world.cpp src/progress.cpp src/doctor.cpp)
target_compile_features(farm_node PUBLIC cxx_std_17)
target_include_directories(farm_node PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>)
ament_target_dependencies(farm_node rclcpp geometry_msgs nav_msgs std_msgs std_srvs)

install(TARGETS farm_node DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch scripts models DESTINATION share/${PROJECT_NAME})
# 画面は web/ のソースから作った web/dist を入れる (作り方は web/Dockerfile の先頭)
if(EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/web/dist/index.html)
  install(DIRECTORY web/dist/ DESTINATION share/${PROJECT_NAME}/web)
else()
  message(WARNING "web/dist がないので画面を入れない. web/ で docker build --output type=local,dest=dist . を実行してから colcon build し直す")
endif()
install(PROGRAMS scripts/match_sim.py DESTINATION lib/${PROJECT_NAME})

ament_package()
