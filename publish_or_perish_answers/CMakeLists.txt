cmake_minimum_required(VERSION 3.10)
project(publish_or_perish_answers)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(std_srvs REQUIRED)

# ament_target_dependencies は Lyrical で無くなったので, ターゲットを直接つなぐ (Jazzy でも同じに動く)
add_executable(stage4_patrol src/stage4_patrol.cpp)
target_link_libraries(stage4_patrol rclcpp::rclcpp ${geometry_msgs_TARGETS})

add_executable(stage5_farmer src/stage5_farmer.cpp)
target_link_libraries(stage5_farmer
  rclcpp::rclcpp ${geometry_msgs_TARGETS} ${nav_msgs_TARGETS} ${std_msgs_TARGETS} ${std_srvs_TARGETS})

add_executable(semi_farmer src/semi_farmer.cpp)
target_link_libraries(semi_farmer
  rclcpp::rclcpp ${geometry_msgs_TARGETS} ${nav_msgs_TARGETS} ${std_srvs_TARGETS})

add_executable(match_semi src/match_semi.cpp)
target_link_libraries(match_semi rclcpp::rclcpp ${std_msgs_TARGETS} ${std_srvs_TARGETS})

add_executable(match_auto src/match_auto.cpp)
target_link_libraries(match_auto rclcpp::rclcpp ${geometry_msgs_TARGETS} ${std_msgs_TARGETS} ${std_srvs_TARGETS})

install(TARGETS stage4_patrol stage5_farmer semi_farmer match_semi match_auto DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})

ament_package()
